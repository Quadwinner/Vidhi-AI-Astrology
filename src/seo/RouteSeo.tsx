import { useLocation } from 'react-router-dom';
import Seo from './Seo';
import { buildCanonical, getSeoForPath, isSelfManaged } from './seoConfig';

export default function RouteSeo() {
  const { pathname } = useLocation();

  if (isSelfManaged(pathname)) return null;

  const meta = getSeoForPath(pathname);
  const canonical = buildCanonical(pathname);

  return (
    <Seo
      title={meta.title}
      description={meta.description}
      canonical={canonical}
      keywords={meta.keywords}
      image={meta.image}
      type={meta.type}
      noindex={meta.noindex}
    />
  );
}
