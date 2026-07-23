const { motion } = window.Motion;

function MirrorText({ text, className = '', reflection = true, reflectionDelay = 1.6, reflectionDuration = 0.9 }) {
  return (
    <div className="relative flex flex-col items-center">
      <BlurText text={text} className={className} />
      {reflection && (
        <motion.div
          aria-hidden="true"
          className="mirror-reflection -mt-[0.18em]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.42 }}
          transition={{ delay: reflectionDelay, duration: reflectionDuration, ease: 'easeOut' }}
        >
          <div className={className}>{text}</div>
        </motion.div>
      )}
    </div>
  );
}

window.MirrorText = MirrorText;
