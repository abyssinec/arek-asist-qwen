/**
 * Настройка поиска по базе знаний. Файлы базы не правим — синонимы и приоритеты живут здесь
 * и легко переносятся на бэкенд вместе с engine.ts.
 */

/** Разговорные синонимы — как посетители на самом деле спрашивают (ru / kk / en). */
export const ALIASES: Record<string, string> = {
  tariff_households: 'тариф цена стоимость киловатт квт квартира физлица баға tariff price kwh electricity',
  payment_physical: 'оплатить оплата заплатить каспи kaspi квитанция касса төлеу төлем pay payment',
  meter_readings: 'показания передать подать счетчик көрсеткіш есептегіш readings meter',
  outages: 'нет света пропал свет отключили электричество авария звонить жарық өшті апат outage power',
  service_locations: 'сервисный центр адрес офис находитесь мекенжай орталық address office',
  fraud_warning: 'мошенники мошенник звонят смс код sms алаяқ scam',
  management_board: 'руководство директор председатель басшылық басқарма management',
  leadership_reception: 'запись прием руководителя жалоба руководству қабылдау reception',
  company_identity: 'компания рэк компаниясы company',
  billing: 'начисления перерасчет квитанция сумма есептеу billing',
  connection_cost: 'стоимость подключения цена бесплатно',
  requisites: 'реквизиты бин иик деректемелер details',
  network_stats: 'подстанций подстанции сети статистика астане',
};

/** Что чаще всего нужно посетителю киоска — выигрывает при близких баллах. */
export const BOOST: Record<string, number> = {
  tariff_households: 1.5,
  payment_physical: 1,
  meter_readings: 1,
  outages: 1.2,
  service_locations: 0.6,
  greeting: -1,
  data_freshness: -1,
};
