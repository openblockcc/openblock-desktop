/* eslint-disable max-len */
import React from 'react';
import styles from './license.css';
import bindAll from 'lodash.bindall';
import classNames from 'classnames';

import OpenBlockLogo from '../icon/logo-OpenBlockcc.svg';
import ScratchFoundationLogo from '../icon/logo-ScratchFoundation.svg';

// Insert new copyright information at the head of the array to add a new copyright notice
const copyrightInformations = [
    {
        id: 'OpenBlock.cc',
        logo: OpenBlockLogo,
        link: 'https://www.openblock.cc/',
        license: 'MIT'
    },
    {
        id: 'Scratch Foundation',
        link: 'https://www.scratchfoundation.org/',
        logo: ScratchFoundationLogo,
        license: 'BSD-3-Clause'
    }
];

const licenseContent = {
    'MIT': (
        <div className={styles.licenseContent}>
            <p>
                Permission is hereby granted, free of charge, to any person obtaining a copy
                of this software and associated documentation files (the &quot;Software&quot;), to deal
                in the Software without restriction, including without limitation the rights
                to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
                copies of the Software, and to permit persons to whom the Software is
                furnished to do so, subject to the following conditions:
            </p>
            <p>
                The above copyright notice and this permission notice shall be included in all
                copies or substantial portions of the Software.
            </p>
            <p>
                THE SOFTWARE IS PROVIDED &quot;AS IS&quot;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
                IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
                FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
                AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
                LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
                OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
                SOFTWARE.
            </p>
        </div>
    ),
    'BSD-3-Clause': (
        <div className={styles.licenseContent}>
            <p>
                Redistribution and use in source and binary forms, with or without modification,
                are permitted provided that the following conditions are met:
            </p>
            <p>
                1. Redistributions of source code must retain the above copyright notice, this
                list of conditions and the following disclaimer.
            </p>
            <p>
                2. Redistributions in binary form must reproduce the above copyright notice, this
                list of conditions and the following disclaimer in the documentation and/or other
                materials provided with the distribution.
            </p>
            <p>
                3. Neither the name of the copyright holder nor the names of its contributors may be
                used to endorse or promote products derived from this software without specific
                prior written permission.
            </p>
            <p>
                THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS &quot;AS IS&quot; AND ANY
                EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
                OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
                SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
                INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
                TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
                OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
                IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING
                IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
                SUCH DAMAGE.
            </p>
        </div>
    )
};

class LicenseElement extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleClickTab'
        ]);
        this.state = {
            selectedTab: copyrightInformations[0].id
        };
    }

    handleClickLogo (e) {
        copyrightInformations.forEach(item => {
            if (item.id === e.currentTarget.alt) {
                window.open(item.link);
            }
        });
    }

    handleClickTab (e) {
        this.setState({selectedTab: e.currentTarget.id});
    }

    buildLicenseTabList () {
        return copyrightInformations.map(item => (
            <button
                key={item.id}
                id={item.id}
                className={classNames(styles.tab, {
                    [styles.isSelected]: this.state.selectedTab === item.id
                })}
                onClick={this.handleClickTab}
            >
                {item.id}
            </button>
        ));
    }

    buildLicenseContent () {
        return copyrightInformations.map(item => (
            <div
                key={item.id}
                className={classNames(styles.tabPanel, {
                    [styles.isSelected]: this.state.selectedTab === item.id
                })}
            >
                <img
                    alt={item.id}
                    className={styles.logo}
                    draggable={false}
                    src={item.logo}
                    onClick={this.handleClickLogo}
                />
                <h4>{item.license} License</h4>
                <h4>Copyright &copy; {item.id}</h4>
                {licenseContent[item.license]}
            </div>
        ));
    }

    render () {
        const tabList = this.buildLicenseTabList();
        const content = this.buildLicenseContent();

        return (
            <div className={styles.licenseBox}>
                <div className={styles.tabList}>
                    {tabList}
                </div>
                <div className={styles.tabs}>
                    {content}
                </div>
            </div>
        );
    }
}

export default <LicenseElement />;
