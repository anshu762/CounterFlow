import { motion } from 'framer-motion';

export default function Section({ title, description, index = 0, className = '', children }) {
  return (
    <motion.section
      aria-label={title}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.06 * index, ease: 'easeOut' }}
      className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:p-6 ${className}`}
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-stone-600">{description}</p>}
      <div className="mt-5">{children}</div>
    </motion.section>
  );
}