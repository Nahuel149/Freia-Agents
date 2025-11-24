import { IPaymentProvider } from './IPaymentProvider'
import { MobbexService } from './mobbex.service'
import { DLocalService } from './dlocal.service'

export class PaymentStrategyFactory {
    static forCountry(countryCode: string): IPaymentProvider {
        return countryCode?.toUpperCase() === 'AR' ? new MobbexService() : new DLocalService()
    }
}
