<script lang="ts">
	import './layout.css';

	const { children } = $props();
</script>

<svelte:head>
	<title>@sveltecraft/annotate</title>
</svelte:head>

{@render children()}
