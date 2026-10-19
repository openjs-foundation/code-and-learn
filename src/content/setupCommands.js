// The setup guide's shell commands, as data. The setup page's frontmatter
// highlights these at build time and ships the HTML with the page, so Shiki
// never reaches the browser.
export const SETUP_COMMANDS = {
	'git-version': { code: 'git --version' },
	'git-config': {
		code: 'git config --global user.name "Your Name"\ngit config --global user.email "you@example.com"',
	},
	clone: {
		code: 'git clone https://github.com/<your-username>/node.git\ncd node\ngit remote add upstream https://github.com/nodejs/node.git\ngit fetch upstream',
	},
	'docker-pull': { code: 'docker pull nodejs/devcontainer:nightly' },
	'podman-pull': { code: 'podman pull nodejs/devcontainer:nightly' },
	'container-build': { code: './configure --ninja\nninja -C out/Release' },
	xcode: { code: 'xcode-select --install' },
	apt: { code: 'sudo apt-get install python3 g++-13 gcc-13 make python3-pip' },
	'distro-fedora': { code: 'sudo dnf install python3 gcc-c++ make python3-pip' },
	'distro-centos': { code: 'sudo yum install python3 gcc-c++ make python3-pip' },
	'distro-suse': { code: 'sudo zypper install python3 gcc-c++ make python3-pip' },
	'distro-arch': { code: 'sudo pacman -S python gcc make python-pip' },
	'local-build': { code: './configure\nmake -j4' },
	'run-test': { code: 'tools/test.py test/parallel/test-assert.js' },
	'test-output': {
		code: '[00:00|% 100|+   1|-   0]: Done\n\nAll tests passed.',
		language: 'text',
	},
	branch: { code: 'git checkout -b my-first-contribution' },
	commit: { code: 'git add .\ngit commit -s -m "doc: fix typo in fs.readFile example"' },
	push: { code: 'git push origin my-first-contribution' },
	'find-newer': { code: 'find src -newer out/Release/node | head' },
	'fix-mtime': {
		code: 'git config --global --add safe.directory /home/developer/nodejs/node\ngit restore-mtime',
	},
	'safe-directory': {
		code: 'git config --global --add safe.directory /home/developer/nodejs/node',
	},
	whatchanged: { code: "git config --global alias.whatchanged 'log --raw --no-merges'" },
};
