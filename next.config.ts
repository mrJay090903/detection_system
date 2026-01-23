import { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  // Webpack configuration for PDF parsing libraries
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark canvas as external to avoid bundling issues
      config.externals = config.externals || [];
      config.externals.push({
        canvas: 'commonjs canvas',
        '@napi-rs/canvas': 'commonjs @napi-rs/canvas',
      });
    }
    
    // Handle .mjs files properly
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: 'javascript/auto',
    });
    
    return config;
  },
  // Serverless function configuration
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
};

export default nextConfig;
