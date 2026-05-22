import { useState } from 'react';

interface Props {
  text: string;
}

const CopyButton: React.FC<Props> = ({ text }) => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button type="button" className="copy-btn" onClick={handleClick}>
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
};

export default CopyButton;
