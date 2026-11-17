package expo.modules.iksdocumentrename

import android.content.ContentResolver
import android.net.Uri
import android.provider.DocumentsContract
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class IksDocumentRenameModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("IksDocumentRename")

    AsyncFunction("renameDocument") { uriString: String, newName: String ->
      val context = requireNotNull(appContext.reactContext) { "App context unavailable" }
      val uri = Uri.parse(uriString)
      require(uri.scheme == ContentResolver.SCHEME_CONTENT) { "Expected a SAF content URI" }
      require(DocumentsContract.isDocumentUri(context, uri)) { "Not an Android document URI" }
      require(newName.isNotBlank() && '/' !in newName && '\u0000' !in newName) {
        "Invalid document name"
      }
      // Android's document provider owns the rename. It may return a new URI,
      // which MUST be used by the JS caller (the previous URI may be invalid).
      val updated = DocumentsContract.renameDocument(context.contentResolver, uri, newName)
        ?: throw IllegalStateException("Document provider refused to rename this file")
      updated.toString()
    }
  }
}
