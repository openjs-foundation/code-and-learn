import Footer from '@node-core/ui-components/Containers/Footer';

const navigation = {
	socialLinks: [{ icon: 'github', link: 'https://github.com/nodejs/node' }],
	footerLinks: [],
};

const primaryLinks = [
	{
		text: 'Contributing to Node.js',
		link: 'https://github.com/nodejs/node/blob/main/CONTRIBUTING.md',
	},
	{
		text: 'Code of Conduct',
		link: 'https://github.com/nodejs/node/blob/main/doc/contributing/code-of-conduct.md',
	},
	{ text: 'nodejs.org', link: 'https://nodejs.org' },
];

export default function SiteFooter({ pathname }) {
	return (
		<Footer
			as="a"
			pathname={pathname}
			navigation={navigation}
			slots={{
				primary: (
					<div className="cl-footer-links">
						{primaryLinks.map(({ text, link }) => (
							<a key={link} href={link} target="_blank" rel="noreferrer">
								{text}
							</a>
						))}
					</div>
				),
				legal: <span>Code and Learn, a Node.js contribution workshop.</span>,
			}}
		/>
	);
}
