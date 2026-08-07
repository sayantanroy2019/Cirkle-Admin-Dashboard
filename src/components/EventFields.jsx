import Field from './Field'
import Select from './Select'
import Textarea from './Textarea'
import Checkbox from './Checkbox'
import { EVENT_TYPE_OPTIONS, SOCIAL_REQUIREMENTS } from '../lib/eventForm'

/**
 * The event field set, shared by create and edit so the two can't diverge.
 *
 * `setField('name')(e)` updates one key; the parent owns the state.
 * `setChecked('requireInstagram')(e)` does the same for the boolean flags,
 * which read `e.target.checked` rather than `e.target.value`.
 */
export default function EventFields({
  form,
  setField,
  setChecked,
  errors = {},
  options,
  disabled = false,
}) {
  return (
    <div className="space-y-5">
      <Field
        label="Event name"
        value={form.name}
        onChange={setField('name')}
        error={errors.name}
        disabled={disabled}
        placeholder="Sunidhi Chauhan Live"
        autoComplete="off"
      />

      <Select
        label="Organizer"
        value={form.organizerId}
        onChange={setField('organizerId')}
        error={errors.organizerId}
        options={options.organizerOptions(form.organizerId)}
        placeholder="Unassigned"
        hint="The organizer who runs this event. Once assigned, it appears in their dashboard."
        disabled={disabled}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label="Category"
          value={form.categoryId}
          onChange={setField('categoryId')}
          error={errors.categoryId}
          options={options.categories}
          placeholder="Choose a category"
          disabled={disabled}
        />
        <Select
          label="City"
          value={form.cityId}
          onChange={setField('cityId')}
          error={errors.cityId}
          options={options.cities}
          placeholder="Choose a city"
          disabled={disabled}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Starts at"
          type="datetime-local"
          value={form.startsAt}
          onChange={setField('startsAt')}
          error={errors.startsAt}
          disabled={disabled}
        />
        <Field
          label="Ends at"
          type="datetime-local"
          value={form.endsAt}
          onChange={setField('endsAt')}
          error={errors.endsAt}
          hint="Optional."
          disabled={disabled}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Target group size"
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          value={form.targetGroupSize}
          onChange={setField('targetGroupSize')}
          error={errors.targetGroupSize}
          hint="How many people a booking group aims for."
          disabled={disabled}
          placeholder="4"
        />
        <Select
          label="Event type"
          value={form.eventType}
          onChange={setField('eventType')}
          error={errors.eventType}
          options={EVENT_TYPE_OPTIONS}
          disabled={disabled}
        />
      </div>

      <Field
        label="Venue name"
        value={form.venueName}
        onChange={setField('venueName')}
        error={errors.venueName}
        hint="Optional."
        disabled={disabled}
        placeholder="Jawaharlal Nehru Stadium"
        autoComplete="off"
      />

      <Field
        label="Venue address"
        value={form.venueAddress}
        onChange={setField('venueAddress')}
        error={errors.venueAddress}
        hint="Optional."
        disabled={disabled}
        placeholder="Lodhi Road, New Delhi"
        autoComplete="off"
      />

      <Textarea
        label="Description"
        value={form.description}
        onChange={setField('description')}
        error={errors.description}
        hint="Optional. Shown to attendees."
        disabled={disabled}
        placeholder="An unforgettable evening…"
      />

      <fieldset>
        <legend className="text-sm font-medium text-gray-700">
          Required social handles
        </legend>
        <p className="mt-1 text-xs text-gray-500">
          Attendees must have these handles on their profile before they can buy
          a ticket or request an invitation.
        </p>
        <div className="mt-3 space-y-2.5">
          {SOCIAL_REQUIREMENTS.map(({ key, label }) => (
            <Checkbox
              key={key}
              label={label}
              checked={form[key]}
              onChange={setChecked(key)}
              disabled={disabled}
            />
          ))}
        </div>
      </fieldset>
    </div>
  )
}
