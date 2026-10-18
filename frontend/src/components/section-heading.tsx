type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
  id: string;
};

export function SectionHeading({ eyebrow, title, description, id }: SectionHeadingProps) {
  return (
    <div className="mb-10 max-w-2xl">
      <p className="mb-4 text-sm font-extrabold uppercase tracking-widest text-brand">{eyebrow}</p>
      <h2 className="mb-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl" id={id}>
        {title}
      </h2>
      <p className="text-lg leading-relaxed text-muted">{description}</p>
    </div>
  );
}
