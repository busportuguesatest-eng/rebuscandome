import nextConfig from 'eslint-config-next/core-web-vitals';

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  ...nextConfig,
  {
    settings: { react: { version: '19' } },
    rules: {
      // These React compiler rules are advisory for this application and
      // conflict with intentional state synchronization in several client UI components.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
    },
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'dist/**',
    ],
  },
];

export default eslintConfig;
