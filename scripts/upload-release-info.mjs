/**
 * @fileoverview
 * Fetch the latest release note and upload it to.digital ocean spaces.
 */
import fetch from 'node-fetch';
import {S3, PutObjectCommand} from '@aws-sdk/client-s3';

export const FILE_PATH = 'desktop/latestRelease.json';
const REPO = 'openblockcc/openblock-desktop';

const s3Client = new S3({
    endpoint: 'https://sgp1.digitaloceanspaces.com',
    region: 'us-east-1', // this SDK requires the region to be us-east-1, an AWS region name
    credentials: {
        accessKeyId: process.env.DO_KEY_ID,
        secretAccessKey: process.env.DO_SECRET_KEY
    }
});

const bucketParams = content => ({
    Bucket: 'openblock',
    Key: FILE_PATH,
    Body: Buffer.from(content, 'utf8'),
    ACL: 'public-read'
});

const getLatest = () => {
    const url = `https://api.github.com/repos/${REPO}/releases/latest`;

    return fetch(url)
        .then(res => res.json());
};

getLatest()
    .then(data => {
        data = JSON.stringify(data, null, 4);
        const param = bucketParams(data);
        try {
            console.log(`Upload release note to ${param.Bucket}/${param.Key}`);
            s3Client.send(new PutObjectCommand(param)).then(() => {
                console.log(
                    `Successfully uploaded object: ${
                        param.Bucket
                    }/${
                        param.Key}`
                );
            });
        } catch (err) {
            console.log('Error', err);
        }
    })
    .catch(err => {
        console.log('Error', err);
    });
