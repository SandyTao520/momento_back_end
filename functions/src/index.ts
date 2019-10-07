import * as functions from 'firebase-functions';

const {Storage} = require('@google-cloud/storage');
// Creates a client
const gcs = new Storage();

import { tmpdir } from 'os';
import { join } from 'path';

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
        const pathArray = filePath!.split('/');
        // get filename and type
        const fileName = pathArray[pathArray.length - 1];
        // skip if it is already a thumbnail
        if (pathArray[pathArray.length - 2] == "thumbnails") {
            return false;
        }
        const imageType = pathArray[pathArray.length - 3];
        // set upload bucket directory
        const uploadDir = pathArray.slice(0, pathArray.length - 2).join('/') + '/thumbnails';

        // handle artefact thumbnail generation
        if (["artefacts", "members", "events"].includes(imageType)) {
            // create tempororary working directory
            const workingDir = join(tmpdir(), 'thumbnails');
            const tmpFilePath = join(workingDir, "source_" + fileName);

            // 1 - ensure directory exists
            await fs.ensureDir(workingDir);

            // 2 - download original file from bucket
            await bucket.file(filePath).download({
                destination: tmpFilePath
            })

            // 3 - define sizes based on image type
            var sizes = [256];
            switch (imageType) {
                case "artefacts":
                    sizes = [256];
                    break;
                case "members":
                    sizes = [128];
                    break;
                case "events":
                    sizes = [512];
                    break;
            }

            // create convert and upload promises
            const uploadPromises = sizes.map(async size => {
                const thumbnailPath = join(workingDir, fileName);

                await sharp(tmpFilePath)
                    .resize(size, size)
                    .withMetadata()
                    .toFile(thumbnailPath)

                return bucket.upload(thumbnailPath, {
                    destination: join(uploadDir, fileName)
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