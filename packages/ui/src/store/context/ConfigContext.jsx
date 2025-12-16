import platformsettingsApi from '@/api/platformsettings'
import PropTypes from 'prop-types'
import { createContext, useContext, useEffect, useState } from 'react'

const ConfigContext = createContext()

export const ConfigProvider = ({ children }) => {
    const [config, setConfig] = useState({})
    const [loading, setLoading] = useState(true)
    // Default to OSS so the UI stays usable even if settings fetch fails
    const [isCloud, setCloudLicensed] = useState(false)
    const [isOpenSource, setOpenSource] = useState(true)

    useEffect(() => {
        const userSettings = platformsettingsApi.getSettings()
        Promise.all([userSettings])
            .then(([currentSettingsData]) => {
                const finalData = {
                    ...currentSettingsData.data
                }
                setConfig(finalData)
                if (finalData.PLATFORM_TYPE === 'cloud') {
                    setCloudLicensed(true)
                    setOpenSource(false)
                } else {
                    // Treat unknown/oss platform types as open-source
                    setOpenSource(true)
                    setCloudLicensed(false)
                }

                setLoading(false)
            })
            .catch((error) => {
                console.error('Error fetching data:', error)
                // Fall back to OSS behaviour when settings cannot be loaded
                setOpenSource(true)
                setCloudLicensed(false)
                setLoading(false)
            })
    }, [])

    return (
        <ConfigContext.Provider value={{ config, loading, isCloud, isOpenSource }}>{children}</ConfigContext.Provider>
    )
}

export const useConfig = () => useContext(ConfigContext)

ConfigProvider.propTypes = {
    children: PropTypes.any
}
