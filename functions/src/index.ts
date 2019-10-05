import * as functions from 'firebase-functions';

const {Storage} = require('@google-cloud/storage');
// Creates a client
const gcs = new Storage();

import { tmpdir } from 'os';
import { join } from 'path';

import * as sharp from 'sharp';
import * as fs from 'fs-extra';

export const generateThumbnails = functions.storage
    .object()
    .onFinalize(async object => {
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
        if (pathArray[pathArray.length - 2] == "thumbnails") {
            return false;
        }
        const imageType = pathArray[pathArray.length - 3];
        // set upload bucket directory
        const uploadDir = pathArray.slice(0, pathArray.length - 2).join('/') + '/thumbnails';

        // handle artefact thumbnail generation
        if (imageType == "artefacts") {
            // create tempororary working directory
            const workingDir = join(tmpdir(), 'thumbnails');
            const tmpFilePath = join(workingDir, 'source');

            // 1 - ensure directory exists
            await fs.ensureDir(workingDir);

            // 2 - download original file from bucket
            await bucket.file(filePath).download({
                destination: tmpFilePath
            })

            // 3 - convert sizes
            const sizes = [128];
            const uploadPromises = sizes.map(async size => {
                const thumbnailPath = join(workingDir, fileName);

                await sharp(tmpFilePath)
                    .resize(size, size)
                    .toFile(thumbnailPath)

                return bucket.upload(thumbnailPath, {
                    destination: join(uploadDir, fileName)
                });
            });

            await Promise.all(uploadPromises);

            return fs.remove(workingDir);
        } else {
            return false;
        }
    });