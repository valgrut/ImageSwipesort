// Keep repeat sorting tied to the exact most recently used swipe and source.
// Do not accidentally reuse destinations from removed/changed presets.
export function findSwipeById(node, id) {
  if (!node || !id) return null;
  if (node.id === id) return node;
  for (const child of Object.values(node.children || {})) {
    const found = findSwipeById(child, id);
    if (found) return found;
  }
  return null;
}

export function makeRepeatSelection(node, sourceUri) {
  if (!node?.id || !node.destination) throw new Error('Swipe has no destination');
  return {nodeId:node.id, destination:node.destination, label:node.name || '', sourceUri};
}

export function repeatSwipeIsValid(lastSwipe, tree, sourceUri, unavailableIds = new Set()) {
  if (!lastSwipe || typeof lastSwipe.destination !== 'string' ||
      !lastSwipe.destination || lastSwipe.sourceUri !== sourceUri) return false;
  const node = findSwipeById(tree, lastSwipe.nodeId);
  return !!node && node.destination === lastSwipe.destination &&
    !unavailableIds.has(node.id);
}

export function repeatDestinationName(lastSwipe, displayPath) {
  if (!lastSwipe?.destination) return 'No previous swipe';
  const parts=displayPath(lastSwipe.destination).split(/[\\/]/).filter(Boolean);
  return parts[parts.length-1] || lastSwipe.label || 'Destination';
}
