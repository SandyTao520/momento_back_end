import * as functions from 'firebase-functions';

// Creates a client
const {Storage} = require('@google-cloud/storage');
const gcs = new Storage();

import { tmpdir } from 'os';
import { join, dirname } from 'path';

import * as sharp from 'sharp';
import * as fs from 'fs-extra';

/*
    Generate a thumbnail and place in the same level of the "original" folder
    the thumbnail has the same name as the original photo
*/
export const generateThumbnails = functions
    .region('asia-northeast1')
    .storage
    .object()
    .onFinalize(async object => {
        // skip any non-image objects
        if (!object.contentType!.includes('image')) {
            return false;
        }
        // get bucket
        const bucket = gcs.bucket(object.bucket);
        // get full file path
        const filePath = object.name;
        // get filename
        const fileName = filePath!.split('/').pop()!;

        // skip already uploaded feature
        if (fileName.includes("thumbnail")) {
            return false;
        }

        // set upload bucket directory
        const uploadDir = dirname(filePath!);
        let uploadName = fileName + "@thumbnail"

        // handle artefact thumbnail generation
        if (fileName.includes("artefact") || fileName.includes("member") || fileName.includes("event") ) {
            // create tempororary working directory
            const workingDir = join(tmpdir(), 'thumbnails');
            const tmpFilePath = join(workingDir, "source_" + fileName + Math.random().toString);

            // 1 - ensure directory exists
            await fs.ensureDir(workingDir);

            // 2 - download original file from bucket
            await bucket.file(filePath).download({
                destination: tmpFilePath,
            })
            const [metadata] = await bucket.file(filePath).getMetadata();

            // 3 - define sizes based on image type
            let sizes = [256];
            if (fileName.includes("artefact")) {
                sizes = [256];
            } else if (fileName.includes("member")) {
                sizes = [256];
            } else {
                sizes = [512];
            }

            // create convert and upload promises
            const destinationPath = join(uploadDir, uploadName);
            const uploadPromises = sizes.map(async size => {
                const thumbnailPath = join(workingDir, uploadName);

                await sharp(tmpFilePath)
                    .resize(size, size)
                    .withMetadata()
                    .toFile(thumbnailPath)

                return bucket.upload(thumbnailPath, {
                    destination: destinationPath,
                    contentType: metadata["contentType"],
                });
            });

            // wait for the promises
            await Promise.all(uploadPromises);

            // clean up
            return fs.remove(workingDir);
        } else {
            return false;
        }
    });