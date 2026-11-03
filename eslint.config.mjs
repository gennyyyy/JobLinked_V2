import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "server/**",
      "db/**",
      "docs/**",
      "plan/**",
      "public/**",
      "next-env.d.ts",
    ],
  },
];

export default config;
