import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'

import FormHeader from '@components/NewRealmWizard/components/FormHeader'
import FormField from '@components/NewRealmWizard/components/FormField'
import FormFooter from '@components/NewRealmWizard/components/FormFooter'
import { InputRangeSlider } from '@components/NewRealmWizard/components/Input'
import Text from '@components/Text'
import AdviceBox from '@components/NewRealmWizard/components/AdviceBox'

import { updateUserInput } from '@utils/formValidation'
import { FORM_NAME as MUTISIG_FORM } from 'pages/dabra/new/multisig'

export const CommunityYesVotePercentageSchema = {
  communityYesVotePercentage: yup
    .number()
    .transform((value) => (isNaN(value) ? 0 : value))
    .max(100, 'Approval cannot require more than 100% of votes')
    .min(1, 'Approval must be at least 1% of votes')
    .required('Required'),
}

export interface CommunityYesVotePercentage {
  communityYesVotePercentage: number
}

export const CouncilYesVotePercentageSchema = {
  councilYesVotePercentage: yup
    .number()
    .transform((value) => (isNaN(value) ? 0 : value))
    .max(100, 'Approval cannot require more than 100% of votes')
    .min(1, 'Quorum must be at least 1% of member')
    .when(
      ['$_programVersion', '$addCouncil'],
      // @ts-expect-error yup types are wrong https://github.com/jquense/yup/issues/649
      (_programVersion, addCouncil, schema) => {
        if (_programVersion >= 3 && addCouncil) {
          return schema.required('Council yes threshold is required')
        }
      },
    ),
}

export interface CouncilYesVotePercentage {
  councilYesVotePercentage: number
}

export default function YesVotePercentageForm({
  type,
  formData,
  currentStep,
  totalSteps,
  forCouncil = false,
  forCommunity = false,
  onSubmit,
  onPrevClick,
  title,
}) {
  const schema = yup
    .object(
      forCommunity
        ? CommunityYesVotePercentageSchema
        : CouncilYesVotePercentageSchema,
    )
    .required()
  const {
    control,
    setValue,
    handleSubmit,
    watch,
    formState: { isValid },
  } = useForm({
    mode: 'all',
    resolver: yupResolver(schema),
    context: formData,
  })
  const fieldName = forCommunity
    ? 'communityYesVotePercentage'
    : forCouncil
    ? 'councilYesVotePercentage'
    : 'yesVotePercentage'
  const percentageValue = !formData.isQuadratic || !forCommunity ? 60 : 5
  const yesVotePercentage = watch(fieldName) || percentageValue

  useEffect(() => {
    updateUserInput(
      formData,
      forCommunity
        ? CommunityYesVotePercentageSchema
        : CouncilYesVotePercentageSchema,
      setValue,
    )
  }, [forCommunity, formData, setValue])

  function serializeValues(values) {
    onSubmit({ step: currentStep, data: values })
  }

  useEffect(() => {
    setValue(fieldName, percentageValue)
  }, [fieldName, formData.isQuadratic, percentageValue, setValue])

  return (
    <form
      onSubmit={handleSubmit(serializeValues)}
      data-testid="yes-vote-percentage-threshold-form"
    >
      <FormHeader
        type={type}
        currentStep={currentStep}
        totalSteps={totalSteps}
        title={title}
      />
      <div className="mt-16 space-y-10 md:space-y-12">
        <Controller
          name={fieldName}
          control={control}
          defaultValue={percentageValue}
          render={({ field, fieldState: { error } }) => (
            <FormField
              title={
                forCommunity
                  ? 'Adjust how much of the community token supply is needed to pass a proposal'
                  : 'Adjust the percentage to determine votes needed to pass a proposal'
              }
              description=""
            >
              <InputRangeSlider field={field} error={error?.message} />
            </FormField>
          )}
        />
      </div>
      <AdviceBox
        title={
          forCommunity
            ? 'Approval percentage'
            : forCouncil
            ? 'Member percentage'
            : 'Yes vote percentage'
        }
        icon={<img src="/icons/threshold-icon.svg" alt="voting icon" />}
      >
        {forCommunity ? (
          <Text level="1">
            {!formData.isQuadratic
              ? 'Typically, newer DAOs start their community approval quorums around 60% of total token supply.'
              : "Setting a high percentage approval quorum may result in proposals never passing in a quadratic voting DAO, as the voting power is influenced by token distribution. It's recomended to start with a low percentage and adjust as needed."}
          </Text>
        ) : forCouncil && formData?.memberAddresses?.length >= 0 ? (
          <>
            <Text level="1">
              With {formData.memberAddresses.length} members added to your{' '}
              {type === MUTISIG_FORM ? 'wallet' : 'DAO'},
            </Text>
            <Text level="1" className="md:pt-2">
              {Math.ceil(
                (yesVotePercentage * formData.memberAddresses.length) / 100,
              )}{' '}
              members would need to approve a proposal for it to pass.
            </Text>
          </>
        ) : (
          <Text level="1">
            Typically, newer DAOs start their approval percentage around 60%.
          </Text>
        )}
      </AdviceBox>

      <FormFooter
        isValid={isValid}
        prevClickHandler={() => onPrevClick(currentStep)}
      />
    </form>
  )
}
