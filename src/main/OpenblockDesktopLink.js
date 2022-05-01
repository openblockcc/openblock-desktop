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
        this._resourceServer = null;

        this.appPath = app.getAppPath();
        if (this.appPath.search(/app/g) !== -1) {
            // Normal app
            this.appPath = path.join(this.appPath, '../../');
        } else if (this.appPath.search(/main/g) !== -1) { // eslint-disable-line no-negated-condition
            // Start by start script it  debug mode.
            this.appPath = path.join(this.appPath, '../../../');
        } else {
            // App in dir mode
            this.appPath = path.join(this.appPath, '../');
        }

        const userDataPath = app.getPath(
            'userData'
        );
        this.dataPath = path.join(userDataPath, 'Data');

        this._storage = new ElectronStore();
        this._link = new OpenBlockLink(this.dataPath, path.join(this.appPath, 'tools'));
        this._resourceServer = new OpenblockResourceServer(this.dataPath,
            path.join(this.appPath, 'external-resources'),
            app.getLocaleCountryCode());
    }

    get resourceServer () {
        return this._resourceServer;
    }

    installDriver () {
        const driverPath = path.join(this.appPath, 'drivers');
        if ((os.platform() === 'win32') && (os.arch() === 'x64')) {
            execFile('install_x64.bat', [], {cwd: driverPath});
        } else if ((os.platform() === 'win32') && (os.arch() === 'ia32')) {
            execFile('install_x86.bat', [], {cwd: driverPath});
        } else if ((os.platform() === 'darwin')) {
            spawn('sh', ['install.sh'], {shell: true, cwd: driverPath});
        }
    }

    clearCache (reboot = true) {
        if (fs.existsSync(this.dataPath)) {
            fs.rmSync(this.dataPath, {recursive: true, force: true});
        }
        if (reboot){
            app.relaunch();
            app.exit();
        }
    }

    updateCahce () {
        const appVersion = app.getVersion();

        // if current version is newer then cache log, delete the data cache dir and write the
        // new version into the cache file.
        if (!this._storage.has('version')) {
            console.log('First launch or older versions exist, try to clearing cache...');
            this.clearCache(false);
            this._storage.set('version', appVersion);
        }
        const oldVersion = this._storage.get('version');
        if (compareVersions.compare(appVersion, oldVersion, '>')) {
            console.log('New version detected, clearing cache...');
            this.clearCache(false);
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
                this.clearCache(false);
                return Promise.reject(e);
            });
    }
}

export default OpenblockDesktopLink;
