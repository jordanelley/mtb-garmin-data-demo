/** Small inline marker + tooltip making clear a value is a computed estimate, not measured data. */
export default function EstimateBadge({ title }) {
  return (
    <span className="estimate-badge" title={title} tabIndex={0}>
      est.
    </span>
  )
}
