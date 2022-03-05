import {app} from 'electron';
import path from 'path';
import os from 'os';
import {execFile, spawn} from 'child_process';
import fs from 'fs-extra';
import ElectronStore from 'electron-store';

import compareVersions from 'compare-versions';

import OpenBlockLink from 'openblock-link';
import OpenblockResourceServer from 'openblock-resource';

class OpenblockDesktopLink {
    constructor () {
        const appPath = app.getAppPath();

        this._resourcePath = null;
        this._resourceServer = null;

        if (appPath.search(/app/g) !== -1) {
            // Normal app
            this._resourcePath = path.join(appPath, '../');
        } else if (appPath.search(/main/g) !== -1) { // eslint-disable-line no-negated-condition
            // Start by start script it  debug mode.
            this._resourcePath = path.join(appPath, '../../');
        } else {
            // App in dir mode
            this._resourcePath = path.join(appPath);
        }

        const userDataPath = app.getPath(
            'userData'
        );
        this._dataPath = path.join(userDataPath, 'Data');

        this._storage = new ElectronStore();
        this._link = new OpenBlockLink(this._dataPath, path.join(this._resourcePath, 'tools'));
        this._resourceServer = new OpenblockResourceServer(this._dataPath,
            path.join(this._resourcePath, 'external-resources'),
            app.getLocaleCountryCode());
    }

    get resourceServer () {
        return this._resourceServer;
    }

    installDriver () {
        const driverPath = path.join(this._resourcePath, 'drivers');
        if ((os.platform() === 'win32') && (os.arch() === 'x64')) {
            execFile('install_x64.bat', [], {cwd: driverPath});
        } else if ((os.platform() === 'win32') && (os.arch() === 'ia32')) {
            execFile('install_x86.bat', [], {cwd: driverPath});
        } else if ((os.platform() === 'darwin')) {
            spawn('sh', ['install.sh'], {shell: true, cwd: driverPath});
        }
    }

    clearCache () {
        if (fs.existsSync(this._dataPath)) {
            fs.rmSync(this._dataPath, {recursive: true, force: true});
        }
        app.relaunch();
        app.exit();
    }

    updateCahce () {
        const appVersion = app.getVersion();

        // if current version is newer then cache log, delet the data cache dir and write the
        // new version into the cache file.
        if (!this._storage.has('version')) {
            this._storage.set('version', appVersion);
        }
        const oldVersion = this._storage.get('version');
        if (compareVersions.compare(appVersion, oldVersion, '>')) {
            console.log('New version detected, clearing cache...');
            if (fs.existsSync(this._dataPath)) {
                fs.rmSync(this._dataPath, {recursive: true, force: true});
            }
            this._storage.set('version', appVersion);
        }
    }

    start () {
        this._link.listen();

        // start resource server
        return this._resourceServer.initializeResources()
            .then(() => {
                this._resourceServer.listen();
                return Promise.resolve();
            })
            .catch(e => {
                // Delet error cache dir and exit
                if (fs.existsSync(this._dataPath)) {
                    fs.rmSync(this._dataPath, {recursive: true, force: true});
                }
                return Promise.reject(e);
            });
    }
}

export default OpenblockDesktopLink;
