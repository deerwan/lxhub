/**
 * @description 提取菜单树中的每一项 uniqueId
 */
export const extractPathList = (tree: any[]): any => {
  if (!Array.isArray(tree)) {
    console.warn('tree must be an array')
    return []
  }
  if (!tree || tree.length === 0) return []
  const expandedPaths: Array<number | string> = []
  for (const node of tree) {
    const hasChildren = node.children && node.children.length > 0
    if (hasChildren) {
      extractPathList(node.children)
    }
    expandedPaths.push(node.uniqueId)
  }
  return expandedPaths
}

/**
 * @description 如果父级下 children 的 length 为 1，删除 children 并自动组建唯一 uniqueId
 */
export const deleteChildren = (tree: any[], pathList = []): any => {
  if (!Array.isArray(tree)) {
    console.warn('menuTree must be an array')
    return []
  }
  if (!tree || tree.length === 0) return []
  for (const [key, node] of tree.entries()) {
    if (node.children && node.children.length === 1) delete node.children
    node.id = key
    node.parentId = pathList.length ? pathList[pathList.length - 1] : null
    node.pathList = [...pathList, node.id]
    node.uniqueId = node.pathList.length > 1 ? node.pathList.join('-') : node.pathList[0]
    const hasChildren = node.children && node.children.length > 0
    if (hasChildren) {
      deleteChildren(node.children, node.pathList)
    }
  }
  return tree
}

/**
 * @description 创建层级关系
 */
export const buildHierarchyTree = (tree: any[], pathList = []): any => {
  if (!Array.isArray(tree)) {
    console.warn('tree must be an array')
    return []
  }
  if (!tree || tree.length === 0) return []
  for (const [key, node] of tree.entries()) {
    node.id = key
    node.parentId = pathList.length ? pathList[pathList.length - 1] : null
    node.pathList = [...pathList, node.id]
    const hasChildren = node.children && node.children.length > 0
    if (hasChildren) {
      buildHierarchyTree(node.children, node.pathList)
    }
  }
  return tree
}

/**
 * @description 广度优先遍历，根据唯一 uniqueId 找当前节点信息
 */
export const getNodeByUniqueId = (tree: any[], uniqueId: number | string): any => {
  if (!Array.isArray(tree)) {
    console.warn('menuTree must be an array')
    return []
  }
  if (!tree || tree.length === 0) return []
  const item = tree.find((node) => node.uniqueId === uniqueId)
  if (item) return item
  const childrenList = tree
    .filter((node) => node.children)
    .map((i) => i.children)
    .flat(1) as unknown
  return getNodeByUniqueId(childrenList as any[], uniqueId)
}

/**
 * @description 构造树型结构数据
 */
export const handleTree = (data: any[], id?: string, parentId?: string, children?: string): any => {
  if (!Array.isArray(data)) {
    console.warn('data must be an array')
    return []
  }
  const config = {
    id: id || 'id',
    parentId: parentId || 'parentId',
    childrenList: children || 'children',
  }

  const childrenListMap: any = {}
  const nodeIds: any = {}
  const tree = []

  for (const d of data) {
    const pid = d[config.parentId]
    if (childrenListMap[pid] == null) {
      childrenListMap[pid] = []
    }
    nodeIds[d[config.id]] = d
    childrenListMap[pid].push(d)
  }

  for (const d of data) {
    const pid = d[config.parentId]
    if (nodeIds[pid] == null) {
      tree.push(d)
    }
  }

  for (const t of tree) {
    adaptToChildrenList(t)
  }

  function adaptToChildrenList(o: Record<string, any>) {
    if (childrenListMap[o[config.id]] !== null) {
      o[config.childrenList] = childrenListMap[o[config.id]]
    }
    if (o[config.childrenList]) {
      for (const c of o[config.childrenList]) {
        adaptToChildrenList(c)
      }
    }
  }
  return tree
}
