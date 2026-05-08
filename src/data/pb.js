import PocketBase from 'pocketbase'

const pb = new PocketBase(
  typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8090'
)

export default pb
