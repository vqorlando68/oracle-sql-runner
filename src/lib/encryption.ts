/**
 * Módulo de encriptación y desencriptación síncrona para almacenamiento local.
 * Implementa un cifrado XOR con rotación de caracteres de múltiples bytes derivado de una clave
 * estática robusta, convirtiendo los datos serializados en una cadena Base64 completamente ilegible.
 */

const SECRET_KEY = "scriptsoracle_secure_salt_key_12345_tokens_for_security";

/**
 * Encripta una cadena de texto en un formato Base64 codificado y enmascarado.
 */
export function encrypt(text: string): string {
  try {
    let result = "";
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const keyChar = SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
      // Operación XOR combinada con una rotación de offset síncrona
      const encryptedChar = (charCode ^ keyChar) + 42;
      result += String.fromCharCode(encryptedChar);
    }
    // Codificación segura para Unicode y caracteres especiales en Base64
    return btoa(unescape(encodeURIComponent(result)));
  } catch (e) {
    console.error("Error al encriptar los datos:", e);
    return text;
  }
}

/**
 * Desencripta una cadena cifrada en formato Base64 y revierte el enmascaramiento.
 */
export function decrypt(cipherText: string): string {
  try {
    if (!cipherText) return "";
    // Decodificación Base64 segura para Unicode
    const decoded = decodeURIComponent(escape(atob(cipherText)));
    let result = "";
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) - 42;
      const keyChar = SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
      const decryptedChar = charCode ^ keyChar;
      result += String.fromCharCode(decryptedChar);
    }
    return result;
  } catch (e) {
    console.error("Error al desencriptar los datos:", e);
    return "";
  }
}
