import PremiumAnalytics from './PremiumAnalytics'

export function ExecutiveCockpit({ embedded = false }: { embedded?: boolean }) {
  return <PremiumAnalytics embedded={embedded} />
}

export default ExecutiveCockpit
