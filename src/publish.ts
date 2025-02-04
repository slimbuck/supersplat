import { Events } from './events';
import { BufferWriter, GZipWriter } from './serialize/writer';
import { serializePlyCompressed, ViewerSettings, SerializeSettings } from './splat-serialize';
import { localize } from './ui/localization';

type PublishSettings = {
    title: string;
    description: string;
    listed: boolean;
    viewerSettings: ViewerSettings;
    serializeSettings: SerializeSettings;
};

const origin = location.origin;

// check whether user is logged in
const testUserStatus = async () => {
    const urlResponse = await fetch(`${origin}/api/id`);
    return urlResponse.ok;
};

const publish = async (data: Uint8Array, publishSettings: PublishSettings) => {
    const filename = 'scene.ply';

    // get signed url
    const urlResponse = await fetch(`${origin}/api/upload/signed-url`, {
        method: 'POST',
        body: JSON.stringify({ filename }),
        headers: {
            'Content-Type': 'application/json'
        }
    });

    if (!urlResponse.ok) {
        throw new Error(`failed to get signed url (${urlResponse.statusText})`);
    }

    const json = await urlResponse.json();

    // upload the file to S3
    const uploadResponse = await fetch(json.signedUrl, {
        method: 'PUT',
        body: data,
        headers: {
            'Content-Type': 'binary/octet-stream'
        }
    });

    if (!uploadResponse.ok) {
        throw new Error('failed to upload blob');
    }

    const publishResponse = await fetch(`${origin}/api/splats/publish`, {
        method: 'POST',
        body: JSON.stringify({
            s3Key: json.s3Key,
            title: publishSettings.title,
            description: publishSettings.description,
            listed: publishSettings.listed,
            settings: publishSettings.viewerSettings
        }),
        headers: {
            'Content-Type': 'application/json'
        }
    });

    if (!publishResponse.ok) {
        let msg;
        try {
            const err = await publishResponse.json();
            msg = err.error ?? msg;
        } catch (e) {
            msg = 'Failed to publish';
        }

        throw new Error(msg);
    }

    return await publishResponse.json();
};

const registerPublishEvents = (events: Events) => {
    events.function('scene.publish', async () => {
        const userValid = await testUserStatus();

        if (!userValid) {
            // use must be logged in to publish
            await events.invoke('showPopup', {
                type: 'error',
                header: localize('popup.error'),
                message: localize('publish.please-log-in')
            });
        } else {
            // get publish options
            const publishSettings: PublishSettings = await events.invoke('show.publishSettingsDialog');

            if (!publishSettings) {
                return;
            }

            try {
                events.fire('startSpinner');

                const splats = events.invoke('scene.splats');

                // serialize/compress
                const writer = new BufferWriter();
                const gzipWriter = new GZipWriter(writer);
                await serializePlyCompressed(splats, publishSettings.serializeSettings, gzipWriter);
                await gzipWriter.close();
                const buffer = writer.close();

                // publish
                const response = await publish(buffer, publishSettings);

                if (!response) {
                    await events.invoke('showPopup', {
                        type: 'error',
                        header: localize('publish.failed'),
                        message: localize('publish.please-try-again')
                    });
                } else {
                    await events.invoke('showPopup', {
                        type: 'info',
                        header: localize('publish.succeeded'),
                        message: localize('publish.message'),
                        link: response.url
                    });
                }
            } catch (error) {
                await events.invoke('showPopup', {
                    type: 'error',
                    header: localize('publish.failed'),
                    message: `'${error.message ?? error}'`
                });
            } finally {
                events.fire('stopSpinner');
            }
        }
    });
};

export { PublishSettings, registerPublishEvents };
