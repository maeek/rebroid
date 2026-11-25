# Rebroid

## Account access

**Account session**

One browser sign-in to a Rebroid account. Tabs that share the browser's sign-in cookie share the account session.

**Display session**

A viewer grant for an Android runtime display. An account can open viewers from multiple account sessions.

## Android devices

**Android device**

A named resource with a durable Rebroid identity and an owner. Its runtime can change over the lifetime of the device.

**Managed device**

An Android device whose container lifecycle, profile storage, and network policy Rebroid manages.
The console lists the application's container resource under **Apps**.

**External device**

An enrolled phone or VM that Rebroid connects to through USB or TCP ADB. The console lists
enrollments under **Devices**. The owner operates the phone or VM outside Rebroid.

**Managed runtime**

The current container of a managed device. Start and recreate can change the runtime while the device keeps its identity.

**Profile storage identity**

The volume name associated with a managed device's profile. Distinct saved profile names can refer to the same volume, so deleting one of those profiles could affect the data used by another.
