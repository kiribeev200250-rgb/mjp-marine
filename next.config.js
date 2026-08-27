/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  // Next 15 по умолчанию держит staleTime динамических страниц равным 0 —
  // это значит, что КАЖДЫЙ клик по ссылке в CRM (переключение вкладок,
  // sidebar) заново дёргает сервер и весь дерево layout'ов, а не переиспользует
  // уже загруженный клиентский Router Cache. 30 секунд достаточно, чтобы
  // повторные переходы между уже посещёнными страницами не били в БД заново,
  // а мутации (router.refresh()/revalidatePath в API-роутах) всё равно рвут
  // кеш немедленно, так что устаревших данных после реального изменения не будет.
  experimental: {
    staleTimes: {
      dynamic: 30,
    },
  },
};

module.exports = nextConfig;
