import { ApiError } from './api'

const fieldNames: Record<string, string> = {email:'Email',password:'Пароль',first_name:'Имя',last_name:'Фамилия',phone:'Телефон',city:'Город',street:'Улица и дом',country:'Страна',label:'Название адреса',recipient_name:'Получатель',new_password:'Новый пароль',current_password:'Текущий пароль'}

/** Turn server field validation into something a customer can act on. */
export function formError(error: unknown, fallback = 'Не удалось сохранить данные. Попробуйте ещё раз.') {
  if (error instanceof ApiError) {
    if (error.status === 422 && error.details.length) return error.details.map(item => {
      const label = fieldNames[item.field] || 'Данные формы'
      if (item.field === 'email') return 'Введите корректный email, например name@example.com.'
      if (item.field === 'password' || item.field === 'new_password') return `${label}: используйте от 10 до 128 символов.`
      if (item.field === 'phone') return 'Проверьте телефон: номер должен содержать от 3 до 32 символов.'
      return `${label}: проверьте значение поля.`
    }).join(' ')
    if (error.status === 409 && /email/i.test(error.message)) return 'Этот email уже зарегистрирован. Войдите в существующий аккаунт.'
    if (error.status === 401) return 'Не удалось войти. Проверьте email и пароль.'
    if (error.message === 'Validation failed') return 'Проверьте заполненные поля и повторите попытку.'
  }
  return error instanceof Error ? error.message : fallback
}
