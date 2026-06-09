export const INSTITUTIONAL_DOMAIN = 'institucional'

export function isInstitutionalEmail(email: string) {

    return /^[a-zA-Z0-9._%+-]+@([a-zA-Z0-9-]+\.)+(edu|edu\.[a-z]{2}|ac\.[a-z]{2})$/i.test(email)
}