module.exports = {
    extends: [
        'eslint:recommended',
        'plugin:markdown/recommended',
        'plugin:react/recommended',
        'plugin:react/jsx-runtime',
        'plugin:react-hooks/recommended',
        'plugin:jsx-a11y/recommended',
        'plugin:prettier/recommended'
    ],
    settings: {
        react: {
            version: 'detect'
        }
    },
    parser: '@typescript-eslint/parser',
    ignorePatterns: ['**/node_modules', '**/dist', '**/build', '**/package-lock.json'],
    plugins: ['unused-imports'],
    rules: {
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        'no-unused-vars': 'off',
        'unused-imports/no-unused-imports': 'off',
        'unused-imports/no-unused-vars': 'off',
        'no-undef': 'off',
        'no-console': 'off',
        'no-empty': ['error', { allowEmptyCatch: true }],
        'react-hooks/exhaustive-deps': 'off',
        'react/prop-types': 'off',
        'prettier/prettier': 'error'
    }
}
