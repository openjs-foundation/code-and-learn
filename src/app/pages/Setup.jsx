import CommandBlock from '../../components/CommandBlock.jsx';
import CommandTabs from '../../components/CommandTabs.jsx';
import { COMMANDS } from 'virtual:cl-setup-commands';

// The guide's shell commands, highlighted at build time by the
// cl-setup-commands virtual module with the same Shiki setup the server uses
// for task/guide markdown, so the browser ships no highlighting code.
const cmd = (key) => {
	const { html, language, lines } = COMMANDS[key];
	return { html, language, className: lines < 5 ? 'no-line-numbers' : undefined };
};
const tabs = (defs) => defs.map(([key, label]) => ({ key, label, ...COMMANDS[key] }));

export default function Setup() {
	return (
		<div className="cl-container cl-setup">
			<h1>From zero to open pull request</h1>
			<p className="cl-lede">
				At the event you'll make a real contribution to{' '}
				<a href="https://github.com/nodejs/node" target="_blank" rel="noreferrer">
					Node.js
				</a>
				. This guide covers both halves: prepare your machine before the event, then repeat the
				contribution loop in the room. Mentors are around the whole time; wave one down at any
				point.
			</p>

			<section aria-labelledby="before-the-event">
				<h2 id="before-the-event">Part 1 — Before the event</h2>
				<div className="cl-callout">
					<p>
						<strong>Complete this part before attending.</strong> It downloads two large artifacts
						(the Node.js repository and a container image) that event Wi-Fi may not be capable of
						handling in the moment. Set aside an hour or two, and don't leave it until the morning
						of: the download and the first build are both slow.
					</p>
				</div>
				<p>
					You are ready when you can <strong>build Node.js and run one test</strong>. The
					contribution workflow is covered in Part 2 and at the event itself.
				</p>

				<ol className="cl-steps">
					<li>
						<h3>A GitHub account</h3>
						<ul>
							<li>
								<a href="https://github.com/signup" target="_blank" rel="noreferrer">
									Create one
								</a>{' '}
								if you don't have one. You sign in to this site with it, and your PR comes from it.
							</li>
							<li>
								<strong>Enable two-factor authentication</strong> — GitHub requires it to contribute
								code. (
								<a
									href="https://docs.github.com/en/authentication/securing-your-account-with-two-factor-authentication/configuring-two-factor-authentication"
									target="_blank"
									rel="noreferrer"
								>
									How to enable 2FA
								</a>
								)
							</li>
						</ul>
					</li>
					<li>
						<h3>Git, installed and configured</h3>
						<p>Check that you have it:</p>
						<CommandBlock {...cmd('git-version')} />
						<p>
							If not,{' '}
							<a href="https://git-scm.com/downloads" target="_blank" rel="noreferrer">
								install Git
							</a>
							. Then tell Git who you are. Use the{' '}
							<strong>same email as your GitHub account</strong> so your contribution is credited to
							you:
						</p>
						<CommandBlock {...cmd('git-config')} />
					</li>
					<li>
						<h3>Fork and clone Node.js</h3>
						<p>
							<a href="https://github.com/nodejs/node/fork" target="_blank" rel="noreferrer">
								Fork <code>nodejs/node</code>
							</a>{' '}
							on GitHub, then clone <strong>your fork</strong> and point it at the upstream repo:
						</p>
						<CommandBlock {...cmd('clone')} />
						<p>
							Check it worked: <code>git remote -v</code> should show <code>origin</code> pointing
							at your fork and <code>upstream</code> at <code>nodejs/node</code>.
						</p>
						<p className="cl-note">
							<strong>The clone is big:</strong> ~1.5 GB down, ~2–2.5 GB on disk. It takes a while.
						</p>
					</li>
					<li>
						<h3>Set up your build environment</h3>
						<p>
							We highly recommend the <strong>dev container</strong>: Node.js publishes a container
							image with all the build dependencies <em>and a prebuilt Node.js</em> already inside,
							turning your first build from around an hour into a few minutes. It also works the
							same across operating systems, so mentors can help when something breaks. A local
							build is specific to your machine, and we may not be able to support every setup.
						</p>
						<p>
							<strong>Install:</strong>
						</p>
						<ul>
							<li>
								A <strong>containerization service</strong> — for example{' '}
								<a href="https://podman.io/" target="_blank" rel="noreferrer">
									Podman
								</a>{' '}
								or{' '}
								<a
									href="https://www.docker.com/products/docker-desktop/"
									target="_blank"
									rel="noreferrer"
								>
									Docker Desktop
								</a>
								. Install it and make sure it's running.
							</li>
							<li>
								A <strong>code editor with Dev Containers support</strong> — most commonly{' '}
								<a href="https://code.visualstudio.com/" target="_blank" rel="noreferrer">
									VS Code
								</a>{' '}
								plus the{' '}
								<a
									href="https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers"
									target="_blank"
									rel="noreferrer"
								>
									Dev Containers extension
								</a>
								. Other options are listed at{' '}
								<a href="https://containers.dev/supporting" target="_blank" rel="noreferrer">
									containers.dev
								</a>
								.
							</li>
						</ul>
						<p>
							<strong>Pull the image</strong> with your container tool:
						</p>
						<CommandTabs
							variants={tabs([
								['docker-pull', 'Docker'],
								['podman-pull', 'Podman'],
							])}
						/>
						<p className="cl-note">
							<strong>Check your disk space first.</strong> The download is ~3.3 GB compressed but{' '}
							<strong>unpacks to about 9 GB</strong>. Leave at least 15 GB free; you also need room
							for the checkout and your build.
						</p>
						<p className="cl-note">
							<strong>Check the resources your container tool is allowed:</strong> at least{' '}
							<strong>4 CPUs and 8 GB of memory</strong>. Compiling C++ is memory-hungry; low
							defaults either crawl or fail with a <code>Killed</code> error mid-build. Docker
							Desktop: <em>Settings → Resources</em>. Podman:{' '}
							<code>podman machine set --cpus 4 --memory 8192</code> (stop the machine first with{' '}
							<code>podman machine stop</code>, then <code>podman machine start</code>).
						</p>
						<p>
							<strong>Start it:</strong>
						</p>
						<ul>
							<li>
								Open your local <code>node</code> folder in your editor.
							</li>
							<li>
								Run your editor's "reopen in container" command. In VS Code that's the command
								palette (<code>Cmd+Shift+P</code> / <code>Ctrl+Shift+P</code>) →{' '}
								<strong>Dev Containers: Reopen in Container</strong>.
							</li>
							<li>
								Pick <strong>Node.js Dev Container</strong> if prompted — the config ships in the
								Node.js repo, so there's nothing to create.
							</li>
							<li>
								Wait for <code>git restore-mtime</code> to finish in the terminal before opening a
								new one. This keeps the prebuilt cache valid; skipping it means a slow rebuild.
							</li>
						</ul>
						<p>
							<strong>Build</strong> (inside the container terminal):
						</p>
						<CommandBlock {...cmd('container-build')} />
						<p>
							Your local checkout is mounted into the container, so your Git config, your fork, and
							your credentials all come from your own machine; no setup needed inside. More detail:{' '}
							<a
								href="https://github.com/nodejs/node/blob/main/doc/contributing/using-devcontainer.md"
								target="_blank"
								rel="noreferrer"
							>
								Developing Node.js using Dev Containers
							</a>
							.
						</p>
						<details>
							<summary>Building locally instead (here be dragons)</summary>
							<p>
								Local setup can be complicated, and we recommend the dev container for your first
								contributions. If you go local anyway, this is a light overview — you'll likely want
								the complete{' '}
								<a
									href="https://github.com/nodejs/node/blob/main/BUILDING.md"
									target="_blank"
									rel="noreferrer"
								>
									BUILDING.md
								</a>{' '}
								reference too.
							</p>
							<p>
								<strong>macOS</strong>: Xcode Command Line Tools and Python 3:
							</p>
							<CommandBlock {...cmd('xcode')} />
							<p>
								<strong>Linux</strong> (Ubuntu/Debian):
							</p>
							<CommandBlock {...cmd('apt')} />
							<p>Other distributions:</p>
							<CommandTabs
								variants={tabs([
									['distro-fedora', 'Fedora'],
									['distro-centos', 'CentOS / RHEL'],
									['distro-suse', 'openSUSE'],
									['distro-arch', 'Arch'],
								])}
							/>
							<p>
								<strong>Windows</strong>: building Node.js natively on Windows is considerably more
								involved. Use the dev container, or{' '}
								<a
									href="https://learn.microsoft.com/en-us/windows/wsl/install"
									target="_blank"
									rel="noreferrer"
								>
									WSL
								</a>{' '}
								with the Linux steps above.
							</p>
							<p>
								<strong>Build:</strong>
							</p>
							<CommandBlock {...cmd('local-build')} />
							<p className="cl-note">
								Expect <strong>45–90 minutes</strong> for this first build; later builds are much
								faster. Make sure nothing else resource-intensive is running, start it, and go do
								something else.
							</p>
						</details>
					</li>
					<li>
						<h3>Verify you're ready</h3>
						<p>Whichever path you took, run one test:</p>
						<CommandBlock {...cmd('run-test')} />
						<p>You should see:</p>
						<CommandBlock {...cmd('test-output')} />
						<p>
							<strong>If you see that, you're done. See you at the event!</strong>
						</p>
					</li>
				</ol>
			</section>

			<section aria-labelledby="at-the-event">
				<h2 id="at-the-event">Part 2 — At the event: the contribution loop</h2>
				<p>
					Every task in the directory ends the same way: a pull request against a Node.js
					repository. You set up once in Part 1; this is the loop you repeat for each task. Want to
					read ahead? Node's own{' '}
					<a
						href="https://github.com/nodejs/node/blob/main/doc/contributing/first-contributions.md"
						target="_blank"
						rel="noreferrer"
					>
						first contributions guide
					</a>{' '}
					walks through the whole process end to end. It's completely optional; we cover all of it
					on the day.
				</p>

				<ol className="cl-steps">
					<li>
						<h3>Claim your task here</h3>
						<p>
							<a href="/">Filter the directory</a> to your skills and time, open a green task, and
							claim it. It locks to you so nobody duplicates your work: one task per person at a
							time, and you can release it if it turns out not to fit.
						</p>
					</li>
					<li>
						<h3>Branch, then make the change</h3>
						<CommandBlock {...cmd('branch')} />
						<p>
							Your task description tells you which files to touch and what done looks like. Doc and
							test changes usually don't need a full rebuild; when a task does need one, you already
							have a working build from Part 1, or ask a mentor to save you the compile time. Most
							tasks target <code>nodejs/node</code>; your task page says so when one targets a
							different repo.
						</p>
					</li>
					<li>
						<h3>Commit like the project does</h3>
						<p>
							Node.js commit messages start with the subsystem you touched, then an imperative
							summary. Node.js also requires a <code>Signed-off-by</code> line on every commit —{' '}
							<code>git commit -s</code> adds it automatically:
						</p>
						<CommandBlock {...cmd('commit')} />
						<p>
							The full rules live in the{' '}
							<a
								href="https://github.com/nodejs/node/blob/main/doc/contributing/pull-requests.md"
								target="_blank"
								rel="noreferrer"
							>
								pull request guide
							</a>
							.
						</p>
					</li>
					<li>
						<h3>Push and open the pull request</h3>
						<CommandBlock {...cmd('push')} />
						<p>
							GitHub will offer to open a PR against <code>nodejs/node</code>. Write a short
							description of what you changed and why, and submit it. CI and reviewers take it from
							there; a mentor can look it over with you first if you'd like.
						</p>
					</li>
					<li>
						<h3>Close the loop</h3>
						<p>
							Paste your PR link on <a href="/me">your task page</a> and mark the task completed.
							Your cell on the wall fills in, the pool reopens for you, and if there is time you go
							again.
						</p>
						<p className="cl-note">
							<strong>Going again? Pick a different type of task.</strong> You've already learned
							the loop for this one; a task from another area (a doc fix, a test split, a{' '}
							<code>spawnSync</code> migration) teaches you a new part of the codebase and spreads
							the variety across the room. Grinding five of the same kind isn't the goal — one of
							each you have time for is a better afternoon.
						</p>
					</li>
				</ol>
			</section>

			<section aria-labelledby="two-rules">
				<h2 id="two-rules">Two rules that cause the most trouble</h2>
				<p>The two mistakes that most often stall a first pull request:</p>
				<ul>
					<li>
						<strong>Rebase, never merge.</strong> Use <code>git pull --rebase upstream main</code>{' '}
						to update your branch. Merging <code>upstream/main</code> into your branch creates a
						merge commit, which breaks the automated commit queue and blocks your PR from landing.
					</li>
					<li>
						<strong>Run the linter before you open the PR.</strong> <code>make lint-js</code> (or{' '}
						<code>make lint-js-fix</code> to auto-fix). Lint failures fail CI, and it's an avoidable
						way to have your first PR go red.
					</li>
				</ul>
			</section>

			<section aria-labelledby="troubleshooting">
				<h2 id="troubleshooting">If something goes wrong</h2>
				<p>
					These all apply to the <strong>dev container</strong> path. Run the commands{' '}
					<em>inside</em> the container.
				</p>
				<details>
					<summary>Your first build seems to be taking forever</summary>
					<p>
						The container ships a prebuilt Node.js, so your first build only compiles a small slice
						of the tree. Figure 5–8 minutes on 6 CPU cores, and up to 20 on 2. Slow on its own
						doesn't mean broken. What <em>is</em> broken is a build churning through{' '}
						<strong>thousands</strong> of files. Don't go by the clock, go by this check:
					</p>
					<CommandBlock {...cmd('find-newer')} />
					<ul>
						<li>
							<strong>No output</strong> — timestamps are fine and the build is still going. Let it
							finish.
						</li>
						<li>
							<strong>Any output</strong> — timestamps are wrong. Run the fix below, then build
							again.
						</li>
					</ul>
					<CommandBlock {...cmd('fix-mtime')} />
					<p>
						<code>git restore-mtime</code> should report tens of thousands of files updated. If it
						says <code>0 files updated</code>, see the last item below.
					</p>
				</details>
				<details>
					<summary>
						<code>fatal: detected dubious ownership in repository</code>
					</summary>
					<p>
						Git won't touch your checkout because it doesn't look owned by the container's user.
						Your checkout is mounted in from your own machine, and container runtimes differ in how
						they map file ownership. Most likely with Podman, Colima, Rancher Desktop, or rootless
						Docker, and less common with Docker Desktop. The test is the same whatever you use: if
						any <code>git</code> command inside the container prints this, run
					</p>
					<CommandBlock {...cmd('safe-directory')} />
					<p>
						Worth fixing even if git isn't what you were trying to use. The container runs{' '}
						<code>git restore-mtime</code> automatically at startup, and when that fails your build
						silently falls back to compiling everything from scratch.
					</p>
				</details>
				<details>
					<summary>
						<code>git restore-mtime</code> reports <code>0 files updated</code>
					</summary>
					<p>
						Harmless-looking and easy to miss: it exits successfully. Run this once, then run{' '}
						<code>git restore-mtime</code> again:
					</p>
					<CommandBlock {...cmd('whatchanged')} />
				</details>
			</section>

			<section aria-labelledby="stuck">
				<h2 id="stuck">Stuck?</h2>
				<p>
					Before the event, ask in the event Slack channel. We'd much rather sort it out beforehand
					than spend your session on it, and we're running pre-event check calls if you'd like help
					live. At the event, mentors are in the room; wave one down.
				</p>
			</section>
		</div>
	);
}
