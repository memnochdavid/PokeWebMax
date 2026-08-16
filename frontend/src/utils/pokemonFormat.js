export function formatPokedexNumber(id) {
  return `#${String(id).padStart(4, '0')}`
}

export function capitalize(text) {
  return text.length > 0 ? text[0].toUpperCase() + text.slice(1) : text
}
