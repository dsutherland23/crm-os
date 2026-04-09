module.exports = {
  ...require('@crm-os/config/eslint.js'),
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
