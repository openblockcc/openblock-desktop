import {ipcRenderer, remote, shell} from 'electron';
import bindAll from 'lodash.bindall';
import omit from 'lodash.omit';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';
import {compose} from 'redux';
import GUI from 'openblock-gui/src/index';
import VM from 'openblock-vm';

import analytics, {initialAnalytics} from 'openblock-gui/src/lib/analytics';
import MessageBoxType from 'openblock-gui/src/lib/message-box.js';
import AppStateHOC from 'openblock-gui/src/lib/app-state-hoc.jsx';
import {
    LoadingStates,
    onFetchedProjectData,
    onLoadedProject,
    defaultProjectId,
    requestNewProject,
    requestProjectUpload,
    setProjectId
} from 'openblock-gui/src/reducers/project-state';
import {
    openLoadingProject,
    closeLoadingProject,
    openUpdateModal
} from 'openblock-gui/src/reducers/modals';
import {setUpdate} from 'openblock-gui/src/reducers/update';

import ElectronStorageHelper from '../common/ElectronStorageHelper';

import styles from './app.css';

// override window.open so that it uses the OS's default browser, not an electron browser
window.open = function (url, target) {
    if (target === '_blank') {
        shell.openExternal(url);
    }
};

const appTarget = document.getElementById('app');
appTarget.className = styles.app || 'app';
document.body.appendChild(appTarget);

GUI.setAppElement(appTarget);

const ScratchDesktopHOC = function (WrappedComponent) {
    class ScratchDesktopComponent extends React.Component {
        constructor (props) {
            super(props);
            bindAll(this, [
                'handleClickCheckUpdate',
                'handleClickUpgrade',
                'handleProjectTelemetryEvent',
                'handleSetTitleFromSave',
                'handleStorageInit',
                'handleShowMessageBox',
                'handleTelemetryModalOptIn',
                'handleTelemetryModalOptOut',
                'handleUpdateProjectTitle'
            ]);
            this.props.onLoadingStarted();
            ipcRenderer.invoke('get-initial-project-data').then(initialProjectData => {
                const hasInitialProject = initialProjectData && (initialProjectData.length > 0);
                this.props.onHasInitialProject(hasInitialProject, this.props.loadingState);
                if (!hasInitialProject) {
                    this.props.onLoadingCompleted();
                    ipcRenderer.send('loading-completed');
                    return;
                }
                this.props.vm.loadProject(initialProjectData).then(
                    () => {
                        this.props.onLoadingCompleted();
                        ipcRenderer.send('loading-completed');
                        this.props.onLoadedProject(this.props.loadingState, true);
                    },
                    e => {
                        this.props.onLoadingCompleted();
                        ipcRenderer.send('loading-completed');
                        this.props.onLoadedProject(this.props.loadingState, false);
                        remote.dialog.showMessageBox(remote.getCurrentWindow(), {
                            type: 'error',
                            title: 'Failed to load project',
                            message: 'Invalid or corrupt project file.',
                            detail: e.message
                        });

                        // this effectively sets the default project ID
                        // TODO: maybe setting the default project ID should be implicit in `requestNewProject`
                        this.props.onHasInitialProject(false, this.props.loadingState);

                        // restart as if we didn't have an initial project to load
                        this.props.onRequestNewProject();
                    }
                );
            });
            this.platform = null;
        }
        componentDidMount () {
            ipcRenderer.on('setTitleFromSave', this.handleSetTitleFromSave);
            ipcRenderer.on('setUpdate', (event, args) => {
                this.props.onSetUpdate(args);
            });
            ipcRenderer.on('setUserId', (event, args) => {
                initialAnalytics(args);
                // Register "base" page view
                analytics.pageview('/', null, 'desktop');
            });
            ipcRenderer.on('setPlatform', (event, args) => {
                this.platform = args;
            });
        }
        componentWillUnmount () {
            ipcRenderer.removeListener('setTitleFromSave', this.handleSetTitleFromSave);
        }
        handleClickLogo () {
            ipcRenderer.send('open-about-window');
        }
        handleClickCheckUpdate () {
            ipcRenderer.send('reqeustCheckUpdate');
        }
        handleClickUpgrade () {
            ipcRenderer.send('reqeustUpgrade');
        }
        handleClickClearCache () {
            ipcRenderer.send('clearCache');
        }
        handleClickInstallDriver () {
            ipcRenderer.send('installDriver');
        }
        handleProjectTelemetryEvent (event, metadata) {
            ipcRenderer.send(event, metadata);
        }
        handleSetTitleFromSave (event, args) {
            this.handleUpdateProjectTitle(args.title);
        }
        handleStorageInit (storageInstance) {
            storageInstance.addHelper(new ElectronStorageHelper(storageInstance));
        }
        handleShowMessageBox (type, message) {
            /**
             * To avoid the electron bug: the input-box lose focus after call alert or confirm on windows platform.
             * https://github.com/electron/electron/issues/19977
            */
            if (this.platform === 'win32') {
                let options;
                if (type === MessageBoxType.confirm) {
                    options = {
                        type: 'warning',
                        buttons: ['Ok', 'Cancel'],
                        message: message
                    };
                } else if (type === MessageBoxType.alert) {
                    options = {
                        type: 'error',
                        message: message
                    };
                }
                const result = remote.dialog.showMessageBoxSync(remote.getCurrentWindow(), options);
                if (result === 0) {
                    return true;
                }
                return false;
            }
            if (type === 'confirm') {
                return confirm(message); // eslint-disable-line no-alert
            }
            return alert(message); // eslint-disable-line no-alert
        }
        handleTelemetryModalOptIn () {
            ipcRenderer.send('setTelemetryDidOptIn', true);
        }
        handleTelemetryModalOptOut () {
            ipcRenderer.send('setTelemetryDidOptIn', false);
        }
        handleUpdateProjectTitle (newTitle) {
            this.setState({projectTitle: newTitle});
        }
        render () {
            const shouldShowTelemetryModal = (typeof ipcRenderer.sendSync('getTelemetryDidOptIn') !== 'boolean');

            const childProps = omit(this.props, Object.keys(ScratchDesktopComponent.propTypes));

            return (<WrappedComponent
                canEditTitle
                canModifyCloudData={false}
                isScratchDesktop
                showTelemetryModal={shouldShowTelemetryModal}
                onClickLogo={this.handleClickLogo}
                onClickCheckUpdate={this.handleClickCheckUpdate}
                onClickUpgrade={this.handleClickUpgrade}
                onClickInstallDriver={this.handleClickInstallDriver}
                onClickClearCache={this.handleClickClearCache}
                onProjectTelemetryEvent={this.handleProjectTelemetryEvent}
                onStorageInit={this.handleStorageInit}
                onShowMessageBox={this.handleShowMessageBox}
                onTelemetryModalOptIn={this.handleTelemetryModalOptIn}
                onTelemetryModalOptOut={this.handleTelemetryModalOptOut}
                onUpdateProjectTitle={this.handleUpdateProjectTitle}
                // allow passed-in props to override any of the above
                {...childProps}
            />);
        }
    }

    ScratchDesktopComponent.propTypes = {
        loadingState: PropTypes.oneOf(LoadingStates),
        onFetchedInitialProjectData: PropTypes.func,
        onHasInitialProject: PropTypes.func,
        onLoadedProject: PropTypes.func,
        onLoadingCompleted: PropTypes.func,
        onLoadingStarted: PropTypes.func,
        onRequestNewProject: PropTypes.func,
        onSetUpdate: PropTypes.func,
        vm: PropTypes.instanceOf(VM).isRequired
    };
    const mapStateToProps = state => {
        const loadingState = state.scratchGui.projectState.loadingState;
        return {
            loadingState: loadingState,
            vm: state.scratchGui.vm
        };
    };
    const mapDispatchToProps = dispatch => ({
        onLoadingStarted: () => dispatch(openLoadingProject()),
        onLoadingCompleted: () => dispatch(closeLoadingProject()),
        onHasInitialProject: (hasInitialProject, loadingState) => {
            if (hasInitialProject) {
                // emulate sb-file-uploader
                return dispatch(requestProjectUpload(loadingState));
            }

            // `createProject()` might seem more appropriate but it's not a valid state transition here
            // setting the default project ID is a valid transition from NOT_LOADED and acts like "create new"
            return dispatch(setProjectId(defaultProjectId));
        },
        onFetchedInitialProjectData: (projectData, loadingState) =>
            dispatch(onFetchedProjectData(projectData, loadingState)),
        onLoadedProject: (loadingState, loadSuccess) => {
            const canSaveToServer = false;
            return dispatch(onLoadedProject(loadingState, canSaveToServer, loadSuccess));
        },
        onRequestNewProject: () => dispatch(requestNewProject(false)),
        onSetUpdate: message => {
            dispatch(setUpdate(message));
            dispatch(openUpdateModal());
        }
    });

    return connect(mapStateToProps, mapDispatchToProps)(ScratchDesktopComponent);
};

// note that redux's 'compose' function is just being used as a general utility to make
// the hierarchy of HOC constructor calls clearer here; it has nothing to do with redux's
// ability to compose reducers.
const WrappedGui = compose(
    AppStateHOC,
    ScratchDesktopHOC
)(GUI);

ReactDOM.render(<WrappedGui />, appTarget);
