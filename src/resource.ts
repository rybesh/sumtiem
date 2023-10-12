class DefaultMap<K, V> extends Map<K, V> {
  constructor(
    private getDefaultValue: (key: K) => V,
    entries?: readonly (readonly [K, V])[] | null
  ) {
    super(entries)
  }

  get = (key: K): V => {
    if (!this.has(key)) {
      this.set(key, this.getDefaultValue(key))
    }

    return super.get(key)!
  }
}

export class Resource {
  id: string
  objectProps: DefaultMap<string, Set<Resource>>
  dataProps: DefaultMap<string, Set<string>>
  types: Set<string>

  constructor(id: string) {
    this.id = id
    this.objectProps = new DefaultMap(() => new Set())
    this.dataProps = new DefaultMap(() => new Set())
    this.types = new Set()
  }
}
