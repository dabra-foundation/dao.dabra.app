import cx from 'classnames'

interface Props {
  className?: string
}

const SocialIcons = (props: Props) => {
  return (
    <div
      className={cx(props.className, 'flex', 'items-center', 'justify-between')}
    >
      <div className="flex gap-x-4 md:gap-x-5">
        <a
          rel="noreferrer"
          target="_blank"
          href="https://twitter.com/dabra"
          className="shadow-sm duration-500 hover:scale-125 focus:scale-125"
        >
          <img src="/icons/twitter.svg" className="h-11" alt="twitter" />
        </a>
        <a
          rel="noreferrer"
          target="_blank"
          href="https://github.com/dabra-foundation/dabra-ui"
          className="shadow-sm duration-500 hover:scale-125 focus:scale-125"
        >
          <img src="/icons/github.svg" className="h-11" alt="github" />
        </a>
      </div>
    </div>
  )
}

export default SocialIcons
