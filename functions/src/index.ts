import * as functions from 'firebase-functions';

import * as Storage from '@google-cloud/firestore';
const gcs = Storage();

import { tmpdir } from 'os';
import { join, dirname } from 'path';

import * as sharp from 'sharp';
import * as fs from 'fs-extra';

export const generateThumbnails = functions.storage
    .object()
    .onFinalize(async object => {
        const bucket = gcs.bucket(object.bucket);
        const filePath = object.name;
        const fileName = filePath.split('/').pop();
        const bucketDir = dirname(filePath);

        const workingDir = join(tmpdir(), 'thumbnails');

        const tmpFilePath = join(workingDir, 'source.png');

        if ( !object.contentType.includes('image')) {
            return false;
        }

        await fs.ensureDir(workingDir);

        await bucket.file(filePath).download({
            destination: tmpFilePath
        })

        const thumbnailPromise = Promise

        const thumbnailName = '${fileName}@128';
        const thumbnailPath = join(workingDir, thumbnailName);

        await sharp(tmpFilePath)
            .resize(128, 128)
            .toFile(thumbnailPath)

        return bucket.upload(thumbnailPath, {
            destination: join(bucketDir, thumbnailName)
        });

        await Promise.all();

        const uploadPromise = 
    });


