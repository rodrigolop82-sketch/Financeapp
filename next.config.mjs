import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@anthropic-ai/sdk'],
  webpack: (config) => {
    config.resolve.alias['@anthropic-ai/sdk'] = path.resolve(
      __dirname,
      'node_modules/@anthropic-ai/sdk/index.mjs'
    )
    return config
  },
};

export default nextConfig;
