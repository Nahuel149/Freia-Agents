import platformsettingsApi from '@/api/platformsettings'
import PropTypes from 'prop-types'
import { createContext, useContext, useEffect, useState } from 'react'

const ConfigContext = createContext()

export const ConfigProvider = ({ children }) => {
    const [config, setConfig] = useState({})
    const [loading, setLoading] = useState(true)
    // OSS mode: Enterprise license state removed
    const [isCloud, setCloudLicensed] = useState(false)
    const [isOpenSource, setOpenSource] = useState(false)

    useEffect(() => {
        const userSettings = platformsettingsApi.getSettings()
        Promise.all([userSettings])
            .then(([currentSettingsData]) => {
                const finalData = {
                    ...currentSettingsData.data
                }
                setConfig(finalData)
                if (finalData.PLATFORM_TYPE) {
                    // OSS mode: Enterprise license handling removed
                    if (finalData.PLATFORM_TYPE === 'cloud') {
                        setCloudLicensed(true)
                        setOpenSource(false)
                    } else {
                        setOpenSource(true)
                        setCloudLicensed(false)
                    }
                }

                setLoading(false)
            })
            .catch((error) => {
                console.error('Error fetching data:', error)
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
