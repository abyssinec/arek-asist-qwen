export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Короткий id без crypto.randomUUID (тот недоступен вне HTTPS/localhost). */
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

/** «•••• 1234» — на экране и в печати показываем только последние 4 цифры. */
export const maskTail = (value: string) => '•••• ' + value.slice(-4);

/** Подставляет цифры в шаблон вида «+7 (###) ###-##-##», пустые места — «_». */
export const fillTemplate = (template: string, digits: string) => {
  let i = 0;
  return template.replace(/#/g, () => digits[i++] ?? '_');
};
