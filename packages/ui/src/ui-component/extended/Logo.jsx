import { useSelector } from 'react-redux'

// ==============================|| LOGO ||============================== //

const Logo = () => {
    const customization = useSelector((state) => state.customization)

    return (
        <div style={{ alignItems: 'center', display: 'flex', flexDirection: 'row', marginLeft: '10px' }}>
            <img 
                src="/assets/Freia.png" 
                alt="Freia Logo" 
                style={{
                    height: '32px',
                    width: 'auto',
                    objectFit: 'contain'
                }}
            />
        </div>
    )
}

export default Logo
