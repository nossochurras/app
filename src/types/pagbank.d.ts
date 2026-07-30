export {}

declare global {
  interface Window {
    PagSeguro?: {
      encryptCard(input: {
        publicKey: string
        holder: string
        number: string
        expMonth: string
        expYear: string
        securityCode: string
      }): {
        encryptedCard?: string
        hasErrors: boolean
        errors?: Array<{ code?: string; message: string }>
      }
    }
  }
}
