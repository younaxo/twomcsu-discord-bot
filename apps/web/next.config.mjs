/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Монорепозиторий: разрешаем Next.js транспилировать workspace-пакеты и не тянуть их отдельно в standalone-сборку.
  transpilePackages: ['@twomcsu/shared', '@twomcsu/db'],
  webpack(config) {
    // @twomcsu/shared и @twomcsu/db пишутся под Node ESM (относительные импорты с ".js",
    // указывающие на .ts-файлы) — это нужно самому бегущему через node дистрибутиву бота.
    // webpack по умолчанию так не резолвит, поэтому явно добавляем alias-расширения.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.discordapp.com' },
      { protocol: 'https', hostname: 'cdn-files.twomc.su' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
