import typescript from "@rollup/plugin-typescript"
import commonjs from "@rollup/plugin-commonjs"

export default {
  input: "src/index.tsx",
  output: {
    file: "dist/index.js",
    format: "esm",
    sourcemap: false,
  },
  plugins: [
    typescript(),
    commonjs(),
  ],
  external: [
    "react",
    "react-dom",
    "@deckyvault/shared",
  ],
}