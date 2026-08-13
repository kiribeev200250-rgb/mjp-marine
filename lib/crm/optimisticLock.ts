import { NextResponse } from 'next/server'

// Оптимистичная блокировка: клиент присылает version, с которой открывал
// форму. Если она разошлась с текущей версией записи — кто-то другой уже
// сохранил правку между открытием формы и этим запросом; отклоняем (409) и
// просим перезагрузить, вместо тихой перезаписи чужих изменений.
//
// version не передан вообще (undefined) — пропускаем проверку. Это НЕ дыра
// в защите, а обратная совместимость: некоторые вызовы (Telegram-бот,
// внутренние сервисные обновления одного поля) не редактируют форму,
// которую можно открыть параллельно, и не обязаны знать текущую версию.
export function checkVersion(clientVersion: unknown, currentVersion: number): NextResponse | null {
  if (clientVersion === undefined || clientVersion === null) return null
  if (Number(clientVersion) !== currentVersion) {
    return NextResponse.json(
      { error: 'Запись была изменена другим пользователем — перезагрузите страницу и повторите правку', code: 'VERSION_CONFLICT' },
      { status: 409 },
    )
  }
  return null
}
