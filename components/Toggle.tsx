function Toggle({ isActive}: { isActive: boolean, }) {
    return (
        <span
            role="switch"
            aria-checked={isActive}
            className={`
                relative inline-block h-5 min-w-[35px] rounded-full transition-colors duration-200
                before:absolute before:left-[2px] before:top-1/2 before:h-[16px] before:w-[16px]
                before:-translate-y-1/2 before:rounded-full before:bg-white before:content-['']
                before:transition-transform before:duration-200 ml-auto
                ${isActive ? 'bg-blue-500 before:translate-x-[15px]' : 'bg-[#ccc]'}
            `}
        /> 
    );
}

export default Toggle;