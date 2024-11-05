const configs = {
    preset: "ts-jest",
    testEnvironment: "node",
    verbose: true,
    reporters: ["default", "<rootDir>/test/utils/reporter.ts"],
    collectCoverage: true,
    collectCoverageFrom: ["<rootDir>/src/chatbot**/*.{ts,tsx}"],
    testPathIgnorePatterns: ["/node_modules/", "/dist/"],
    setupFiles: ["<rootDir>/jest.env-setup.js"]
};

module.exports = configs;
